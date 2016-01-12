// ==UserScript==
// @name        Release to request
// @description	Import metadata from a MusicBrainz release group into a What.CD request
// @namespace   http://janse.se/
// @include     https://what.cd/requests.php?action=new
// @version     0.1
// @grant       none
// ==/UserScript==

var debugging = false;

$("tbody").prepend('<tr> <td class="label">Import from MusicBrainz</td> <td> <input id="mbid_box" size="8" value="" type="text"> <input value="Import" id="mbid_button" type="button"> </td> </tr>');
$("#mbid_button").click(importMetadata);

if(debugging) {
	$("#mbid_box").val("0e5b4580-4e6d-43e6-8384-0d13ac52a9d7");
	$("#mbid_button").click();
}

function importMetadata(){
	var input = $("#mbid_box").val();
	var mbid = input.match("[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+")[0];
	url = 'http://musicbrainz.org/release-group/' + mbid;

	// get release group metadata
	$.ajax({
		method: 'GET',
		url: 'https://musicbrainz.org/ws/2/release-group/' + mbid + '?inc=artists',
	       	success: enterReleaseGroup,
		error: function(xml) {
			console.log("Release group request failed");
		}
	});

	// get release metadata
	$.ajax({
		method: 'GET',
		url: 'https://musicbrainz.org/ws/2/release?release-group=' + mbid + '&inc=url-rels',
	       	success: enterRelease,
		error: function(xml) {
			console.log("Release request failed");
		}
	});

	// allow all formats, bitrates and media
	$('#toggle_formats').prop("checked", true).change();
	$('#toggle_bitrates').prop("checked", true).change();
	$('#toggle_media').prop("checked", true).change();
}

function enterReleaseGroup(xml) {
	// get metadata from XML
	var artist = $(xml).find("name").text();	
	var title = $(xml).find("title").text();
	var year = $(xml).find("first-release-date").text().match("[0-9]{4}")[0];
	var type = $(xml).find("release-group").attr("type");

	// enter metadata in form
	$('[name="artists[]"]').val(artist);	
	$('[name="title"]').val(title);	
	$('[name="year"]').val(year);	
	var dd_val = $('select option').filter(function () { return $(this).html() == type;}).val(); 
	$('#releasetype').val(dd_val);
}

function enterRelease(xml) {
	// get URL relationships
	text = "Any release of this accepted. Thanks!\n\n";
	text += "[b]MusicBrainz[/b]\n[*]" + url + "\n";

	listUrls(xml, "download for free", "Download for free");
	listUrls(xml, "purchase for download", "Purchase for download");
	listUrls(xml, "purchase for mail-order", "Purchase for mail-order");
	listUrls(xml, "amazon asin", "Amazon");

	$('textarea[name="description"]').text(text.trim());
}

function listUrls(xml, type, intro) {
	var list = "";

	$(xml).find('[type="' + type + '"] target').each(function() {
		if (list == "") {
			list += "[b]" + intro + "[/b]\n";
		}

		list += "[*]" + $(this).text() + "\n";
	});
	
	if (list != "") {	
		text += list;
	}
}
